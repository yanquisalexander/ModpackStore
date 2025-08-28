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
exports.AdminUsersController = void 0;
const adminUsers_service_1 = require("../services/adminUsers.service");
class AdminUsersController {
    static listUsers(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield (0, adminUsers_service_1.getAllUsers)();
                return c.json(users);
            }
            catch (err) {
                return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
            }
        });
    }
    static getUser(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = c.req.param();
                const user = yield (0, adminUsers_service_1.getUserById)(userId);
                if (!user)
                    return c.json({ error: 'User not found' }, 404);
                return c.json(user);
            }
            catch (err) {
                return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
            }
        });
    }
    static updateUser(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = c.req.param();
                const body = yield c.req.json();
                const updated = yield (0, adminUsers_service_1.updateUser)(userId, body);
                return c.json(updated);
            }
            catch (err) {
                return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
            }
        });
    }
    static deleteUser(c) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = c.req.param();
                yield (0, adminUsers_service_1.deleteUser)(userId);
                return c.json({ success: true });
            }
            catch (err) {
                return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
            }
        });
    }
}
exports.AdminUsersController = AdminUsersController;
