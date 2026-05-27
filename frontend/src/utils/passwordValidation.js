export const PASSWORD_REQUIREMENTS = [
  {
    id: "min_length",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    id: "uppercase",
    label: "1 uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "1 lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "1 number",
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "1 special character",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function getPasswordValidationResults(password) {
  const value = typeof password === "string" ? password : "";
  return PASSWORD_REQUIREMENTS.map((rule) => ({
    ...rule,
    isMet: rule.test(value),
  }));
}

export function validatePassword(password) {
  const results = getPasswordValidationResults(password);
  const errors = results.filter((rule) => !rule.isMet).map((rule) => rule.label);

  return {
    isValid: errors.length === 0,
    errors,
    results,
  };
}
