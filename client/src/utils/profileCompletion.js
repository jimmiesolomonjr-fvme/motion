export function getProfileCompletion(user) {
  const missing = [];
  let percent = 0;

  const profile = user?.profile || user;

  if (profile?.displayName) {
    percent += 10;
  } else {
    missing.push({ key: 'displayName', label: 'Display Name' });
  }

  if (profile?.bio) {
    percent += 10;
  } else {
    missing.push({ key: 'bio', label: 'Bio' });
  }

  if (profile?.city) {
    percent += 10;
  } else {
    missing.push({ key: 'city', label: 'City' });
  }

  const photos = profile?.photos || [];
  if (photos.length >= 2) {
    percent += 15;
    if (photos.length >= 4) {
      percent += 5;
    } else {
      missing.push({ key: 'photos4', label: '4+ Photos' });
    }
  } else {
    missing.push({ key: 'photos2', label: '2+ Photos' });
  }

  if (profile?.height) {
    percent += 10;
  } else {
    missing.push({ key: 'height', label: 'Height' });
  }

  if (profile?.weight) {
    percent += 5;
  } else {
    missing.push({ key: 'weight', label: 'Weight' });
  }

  if (profile?.occupation) {
    percent += 10;
  } else {
    missing.push({ key: 'occupation', label: 'Occupation' });
  }

  const tags = profile?.lookingForTags || [];
  if (tags.length >= 1) {
    percent += 10;
  } else {
    missing.push({ key: 'lookingForTags', label: 'Looking For Tags' });
  }

  if (profile?.songTitle) {
    percent += 10;
  } else {
    missing.push({ key: 'song', label: 'Profile Song' });
  }

  const prompts = profile?.profilePrompts || [];
  if (prompts.length >= 1) {
    percent += 5;
  } else {
    missing.push({ key: 'prompts', label: 'Profile Prompts' });
  }

  return { percent, missing };
}
