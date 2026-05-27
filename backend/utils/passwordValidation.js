export const PASSWORD_REQUIREMENTS = [
  {
    id: "min_length",
    message: "Password must be at least 8 characters.",
    test: (password) => password.length >= 8,
  },
  {
    id: "uppercase",
    message: "Password must include at least one uppercase letter.",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    message: "Password must include at least one lowercase letter.",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    message: "Password must include at least one number.",
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    message: "Password must include at least one special character.",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function getPasswordValidationErrors(password) {
  const value = typeof password === "string" ? password : "";
  return PASSWORD_REQUIREMENTS.filter((rule) => !rule.test(value)).map(
    (rule) => rule.message,
  );
}

export function validatePassword(password) {
  const errors = getPasswordValidationErrors(password);
  return {
    isValid: errors.length === 0,
    errors,
    message: errors[0] || "",
  };
}
