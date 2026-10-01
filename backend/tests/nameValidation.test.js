import test from "node:test";
import assert from "node:assert/strict";
import { isValidName } from "../utils/nameValidation.js";
import { isValidName as frontendValid } from "../../frontend/src/modules/authentication/utils/nameValidation.js";
import { requestAccess, sendRequestAccessOtp } from "../controllers/authController.js";
import WebUser from "../models/WebUser.js";
import { isRequiredText, isValidEmail } from "../utils/accessFieldValidation.js";
import { isRequiredText as clientText, isValidEmail as clientEmail } from "../../frontend/src/modules/authentication/utils/accessFieldValidation.js";

test("web signup rejects missing, blank, wrong-type, malformed and oversized fields before OTP work", async () => {
  const valid = { firstName: "Juan", lastName: "Cruz", email: "test@example.com", password: "StrongPassword1!", organization: "CESU", position: "Officer", requestedRole: "cesu" };
  for (const handler of [requestAccess, sendRequestAccessOtp]) {
    const reject = async (body) => {
      const response = { statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await handler({ body }, response);
      assert.equal(response.statusCode, 400);
    };
    await reject(null);
    await reject(undefined);
    for (const field of Object.keys(valid)) {
      for (const value of [null, undefined, "", "   ", {}, [], 12, false]) await reject({ ...valid, [field]: value });
    }
    await reject({ ...valid, email: "not-an-email" });
    await reject({ ...valid, organization: "a".repeat(121) });
    await reject({ ...valid, position: "a".repeat(121) });
  }
  for (const value of [null, "", " ", [], "CESU", "a".repeat(121)]) assert.equal(isRequiredText(value), clientText(value));
  for (const value of [null, "bad", [], "test@example.com", " test@example.com "]) assert.equal(isValidEmail(value), clientEmail(value));
});

test("name policy agrees across clients and rejects markup, controls, and non-string values", () => {
  for (const name of ["Juan", "Dela Cruz", "María", "O’Neill", "Anne-Marie", "Jose\u0301"]) {
    assert.equal(isValidName(name), true);
    assert.equal(frontendValid(name), true);
  }
  for (const name of ["", "   ", "<script>alert('XSS')</script>", "Juan1", "Juan\nCruz", "😀", "-Juan", "Juan-", "a".repeat(81), {}, ["Juan"]]) {
    assert.equal(isValidName(name), false);
    assert.equal(frontendValid(name), false);
  }
});

test("both access endpoints reject invalid names before OTP or database work", async () => {
  for (const handler of [requestAccess, sendRequestAccessOtp]) {
    const response = { statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ body: { firstName: "<script>", lastName: "Cruz", email: "test@example.com", password: "StrongPassword1!", organization: "CESU", position: "Officer", requestedRole: "cesu" } }, response);
    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /name/i);
  }
});

test("schema derives a safe display name and rejects invalid new identities", async () => {
  const user = new WebUser({ firstName: "Juan", lastName: "Dela Cruz", username: "<script>", email: "test@example.com", password: "hashed" });
  await user.validate();
  assert.equal(user.username, "Juan Dela Cruz");
  user.firstName = "<script>";
  await assert.rejects(user.validate(), /firstName/);
});
