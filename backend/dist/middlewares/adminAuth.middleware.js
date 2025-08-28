"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAdmin = ensureAdmin;
/**
 * Middleware to ensure that the authenticated user has administrative privileges.
 */
function ensureAdmin(c, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get('user');
        if (!user || user.admin !== true) {
            return c.json({ error: 'Forbidden', message: 'You do not have administrative privileges.' }, 403);
        }
        yield next();
    });
}
