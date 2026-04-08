import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PAIRING_EXPIRY_HOURS = 24;

export async function joinPool(moveId, userId) {
  // Verify move exists and is community
  const move = await prisma.move.findUnique({
    where: { id: moveId },
    select: { id: true, isCommunity: true, isActive: true, status: true, expiresAt: true, creator: { select: { isDummy: true, isAdmin: true } } },
  });

  if (!move) throw new Error('Move not found');

  // Support both explicit isCommunity flag and legacy inference
  const isCommunity = move.isCommunity || move.creator?.isDummy || move.creator?.isAdmin;
  if (!isCommunity) throw new Error('Not a community move');
  if (!move.isActive || move.status !== 'OPEN') throw new Error('Move is no longer active');
  if (move.expiresAt && new Date(move.expiresAt) < new Date()) throw new Error('Move has expired');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, profile: { select: { displayName: true, photos: true } } },
  });
  if (!user) throw new Error('User not found');

  // Upsert pool entry
  const poolEntry = await prisma.communityMovePool.upsert({
    where: { moveId_userId: { moveId, userId } },
    update: {},
    create: {
      moveId,
      userId,
      role: user.role,
    },
  });

  // If already paired, return current status
  if (poolEntry.paired) {
    const existingPairing = await prisma.communityMovePairing.findFirst({
      where: {
        moveId,
        OR: [{ baddieId: userId }, { stepperId: userId }],
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });
    return { status: 'already_paired', pairing: existingPairing };
  }

  // FIFO matching: find oldest unpaired opposite-role entry
  const oppositeRole = user.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';

  // Use transaction for race safety
  const result = await prisma.$transaction(async (tx) => {
    const match = await tx.communityMovePool.findFirst({
      where: {
        moveId,
        role: oppositeRole,
        paired: false,
        userId: { not: userId },
      },
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: { id: true, role: true, profile: { select: { displayName: true, photos: true } } } } },
    });

    if (!match) {
      return { status: 'in_pool', message: 'Waiting for a match' };
    }

    // Mark both as paired
    const now = new Date();
    await tx.communityMovePool.update({
      where: { id: poolEntry.id },
      data: { paired: true, pairedAt: now },
    });
    await tx.communityMovePool.update({
      where: { id: match.id },
      data: { paired: true, pairedAt: now },
    });

    // Determine baddie/stepper
    const baddieId = user.role === 'BADDIE' ? userId : match.userId;
    const stepperId = user.role === 'STEPPER' ? userId : match.userId;

    // Create conversation for the pair
    const [u1, u2] = [baddieId, stepperId].sort();
    let conversation = await tx.conversation.findUnique({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    });
    if (!conversation) {
      conversation = await tx.conversation.create({
        data: { user1Id: u1, user2Id: u2, moveId },
      });
    } else if (!conversation.moveId) {
      conversation = await tx.conversation.update({
        where: { id: conversation.id },
        data: { moveId },
      });
    }

    // Create pairing
    const expiresAt = new Date(Date.now() + PAIRING_EXPIRY_HOURS * 60 * 60 * 1000);
    const pairing = await tx.communityMovePairing.create({
      data: {
        moveId,
        baddieId,
        stepperId,
        conversationId: conversation.id,
        expiresAt,
      },
    });

    // Increment community match count
    await tx.move.update({
      where: { id: moveId },
      data: { communityMatchCount: { increment: 1 } },
    });

    return {
      status: 'paired',
      pairing,
      conversationId: conversation.id,
      matchedUser: match.user,
    };
  });

  // If paired, send notifications (outside transaction)
  if (result.status === 'paired') {
    const moveData = await prisma.move.findUnique({
      where: { id: moveId },
      select: { title: true },
    });

    const matchedUserId = result.pairing.baddieId === userId
      ? result.pairing.stepperId
      : result.pairing.baddieId;

    const matchedProfile = result.matchedUser?.profile;

    // Create notifications for both users
    await prisma.notification.createMany({
      data: [
        {
          userId,
          type: 'community_move_paired',
          title: 'You\'ve Been Paired!',
          body: `You and ${matchedProfile?.displayName || 'someone'} are paired for "${moveData?.title}"!`,
          data: { moveId, pairingId: result.pairing.id, matchedUserId, conversationId: result.conversationId },
        },
        {
          userId: matchedUserId,
          type: 'community_move_paired',
          title: 'You\'ve Been Paired!',
          body: `You and ${user.profile?.displayName || 'someone'} are paired for "${moveData?.title}"!`,
          data: { moveId, pairingId: result.pairing.id, matchedUserId: userId, conversationId: result.conversationId },
        },
      ],
    });

    // Emit socket events
    try {
      const { io } = await import('../../server.js');
      if (io) {
        const pairingData = {
          type: 'community_move_paired',
          moveId,
          pairingId: result.pairing.id,
          moveTitle: moveData?.title,
          conversationId: result.conversationId,
        };

        io.to(userId).emit('community-move-paired', {
          ...pairingData,
          matchedUser: matchedProfile,
          matchedUserId,
        });
        io.to(matchedUserId).emit('community-move-paired', {
          ...pairingData,
          matchedUser: user.profile,
          matchedUserId: userId,
        });
      }
    } catch {}
  }

  return result;
}

export async function respondToPairing(pairingId, userId, accepted) {
  const pairing = await prisma.communityMovePairing.findUnique({
    where: { id: pairingId },
    include: {
      move: { select: { id: true, title: true } },
      baddie: { select: { id: true, profile: { select: { displayName: true } } } },
      stepper: { select: { id: true, profile: { select: { displayName: true } } } },
    },
  });

  if (!pairing) throw new Error('Pairing not found');
  if (pairing.status !== 'PENDING') throw new Error('Pairing already resolved');
  if (pairing.baddieId !== userId && pairing.stepperId !== userId) {
    throw new Error('Not your pairing');
  }
  if (new Date(pairing.expiresAt) < new Date()) {
    await prisma.communityMovePairing.update({
      where: { id: pairingId },
      data: { status: 'EXPIRED', resolvedAt: new Date() },
    });
    throw new Error('Pairing has expired');
  }

  const isBaddie = pairing.baddieId === userId;
  const otherUserId = isBaddie ? pairing.stepperId : pairing.baddieId;

  if (accepted) {
    const updateData = isBaddie
      ? { baddieAccepted: true }
      : { stepperAccepted: true };

    const updated = await prisma.communityMovePairing.update({
      where: { id: pairingId },
      data: updateData,
    });

    // Check if both accepted
    const bothAccepted = isBaddie
      ? (updated.baddieAccepted && updated.stepperAccepted)
      : (updated.stepperAccepted && updated.baddieAccepted);

    if (bothAccepted) {
      await prisma.communityMovePairing.update({
        where: { id: pairingId },
        data: { status: 'ACCEPTED', resolvedAt: new Date() },
      });

      // Notify both users
      const otherName = isBaddie
        ? pairing.stepper.profile?.displayName
        : pairing.baddie.profile?.displayName;

      await prisma.notification.createMany({
        data: [
          {
            userId,
            type: 'community_move_confirmed',
            title: 'It\'s a Date!',
            body: `You and ${otherName || 'your match'} both accepted for "${pairing.move.title}"!`,
            data: { moveId: pairing.moveId, pairingId, conversationId: pairing.conversationId },
          },
          {
            userId: otherUserId,
            type: 'community_move_confirmed',
            title: 'It\'s a Date!',
            body: `You and ${isBaddie ? pairing.baddie.profile?.displayName : pairing.stepper.profile?.displayName || 'your match'} both accepted for "${pairing.move.title}"!`,
            data: { moveId: pairing.moveId, pairingId, conversationId: pairing.conversationId },
          },
        ],
      });

      try {
        const { io } = await import('../../server.js');
        if (io) {
          const confirmData = {
            type: 'community_move_confirmed',
            moveId: pairing.moveId,
            pairingId,
            moveTitle: pairing.move.title,
            conversationId: pairing.conversationId,
          };
          io.to(userId).emit('community-move-confirmed', confirmData);
          io.to(otherUserId).emit('community-move-confirmed', confirmData);
        }
      } catch {}

      return { status: 'confirmed', conversationId: pairing.conversationId };
    }

    return { status: 'waiting_for_other' };
  } else {
    // Pass — mark as PASSED
    await prisma.communityMovePairing.update({
      where: { id: pairingId },
      data: { status: 'PASSED', resolvedAt: new Date() },
    });

    // Return passer to pool for re-matching
    await prisma.communityMovePool.updateMany({
      where: { moveId: pairing.moveId, userId },
      data: { paired: false, pairedAt: null },
    });

    // Return other user to pool too
    await prisma.communityMovePool.updateMany({
      where: { moveId: pairing.moveId, userId: otherUserId },
      data: { paired: false, pairedAt: null },
    });

    // Attempt re-match for the other user
    try {
      await joinPool(pairing.moveId, otherUserId);
    } catch {
      // Re-match attempt is best-effort
    }

    return { status: 'passed' };
  }
}

export async function getUserPoolStatus(moveId, userId) {
  const poolEntry = await prisma.communityMovePool.findUnique({
    where: { moveId_userId: { moveId, userId } },
  });

  if (!poolEntry) return { status: 'not_joined' };

  if (poolEntry.paired) {
    const pairing = await prisma.communityMovePairing.findFirst({
      where: {
        moveId,
        OR: [{ baddieId: userId }, { stepperId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        baddie: { select: { id: true, profile: { select: { displayName: true, photos: true } } } },
        stepper: { select: { id: true, profile: { select: { displayName: true, photos: true } } } },
      },
    });

    if (pairing) {
      const matchedUser = pairing.baddieId === userId ? pairing.stepper : pairing.baddie;
      return {
        status: 'paired',
        pairing: {
          id: pairing.id,
          status: pairing.status,
          matchedUser,
          conversationId: pairing.conversationId,
          expiresAt: pairing.expiresAt,
          myAccepted: pairing.baddieId === userId ? pairing.baddieAccepted : pairing.stepperAccepted,
          otherAccepted: pairing.baddieId === userId ? pairing.stepperAccepted : pairing.baddieAccepted,
        },
      };
    }
  }

  return { status: 'in_pool', joinedAt: poolEntry.joinedAt };
}
