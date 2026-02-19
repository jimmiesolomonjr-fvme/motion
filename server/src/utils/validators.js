export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

export function validateAge(age) {
  return Number.isInteger(age) && age >= 18 && age <= 99;
}

export function validateRole(role) {
  return ['STEPPER', 'BADDIE'].includes(role);
}
