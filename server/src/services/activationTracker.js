import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Check if a message to recipientId fulfills their first-message activation.
 * Called after any message is created.
 */
export async function checkFirstMessageActivation(recipientId, senderId) {
  const activation = await prisma.userActivation.findUnique({
    where: { userId: recipientId },
  });

  if (!activation || !activation.needsFirstMessage) return;

  await prisma.userActivation.update({
    where: { id: activation.id },
    data: {
      firstInboundMessageAt: new Date(),
      activationStatus: 'MESSAGED',
      needsFirstMessage: false,
    },
  });
}

/**
 * Check if the sender (who was a new user) is replying to someone —
 * transitions activation from MESSAGED to REPLIED.
 */
export async function checkFirstReplyActivation(senderId) {
  const activation = await prisma.userActivation.findUnique({
    where: { userId: senderId },
  });

  if (!activation || activation.activationStatus !== 'MESSAGED') return;

  await prisma.userActivation.update({
    where: { id: activation.id },
    data: {
      firstReplyAt: new Date(),
      activationStatus: 'REPLIED',
    },
  });
}
