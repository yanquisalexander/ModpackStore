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
const hono_1 = require("hono");
const UserModpacksController_1 = require("../../controllers/UserModpacksController");
const modpackRoutes = new hono_1.Hono();
// Utilidad para status code en Hono
function jsonWithStatus(c, data, code) {
    return c.json(data, code);
}
// Adaptadores Hono para los controladores Express
function createModpackHono(c) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get('user');
        const body = yield c.req.json();
        c.req.user = user;
        c.req.body = body;
        return yield new Promise((resolve) => {
            UserModpacksController_1.UserModpacksController.createModpack(c.req, {
                status: (code) => ({ json: (data) => resolve(jsonWithStatus(c, data, code)) }),
                json: (data) => resolve(c.json(data)),
                send: () => resolve(c.body(null, 204)),
            }, () => { });
        });
    });
}
function listUserModpacksHono(c) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get('user');
        c.req.user = user;
        return yield new Promise((resolve) => {
            UserModpacksController_1.UserModpacksController.listUserModpacks(c.req, {
                status: (code) => ({ json: (data) => resolve(jsonWithStatus(c, data, code)) }),
                json: (data) => resolve(c.json(data)),
                send: () => resolve(c.body(null, 204)),
            }, () => { });
        });
    });
}
function getModpackHono(c) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get('user');
        c.req.user = user;
        c.req.params = { modpackId: c.req.param('modpackId') };
        return yield new Promise((resolve) => {
            UserModpacksController_1.UserModpacksController.getModpack(c.req, {
                status: (code) => ({ json: (data) => resolve(jsonWithStatus(c, data, code)) }),
                json: (data) => resolve(c.json(data)),
                send: () => resolve(c.body(null, 204)),
            }, () => { });
        });
    });
}
function updateModpackHono(c) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get('user');
        const body = yield c.req.json();
        c.req.user = user;
        c.req.body = body;
        c.req.params = { modpackId: c.req.param('modpackId') };
        return yield new Promise((resolve) => {
            UserModpacksController_1.UserModpacksController.updateModpack(c.req, {
                status: (code) => ({ json: (data) => resolve(jsonWithStatus(c, data, code)) }),
                json: (data) => resolve(c.json(data)),
                send: () => resolve(c.body(null, 204)),
            }, () => { });
        });
    });
}
function deleteModpackHono(c) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get('user');
        c.req.user = user;
        c.req.params = { modpackId: c.req.param('modpackId') };
        return yield new Promise((resolve) => {
            UserModpacksController_1.UserModpacksController.deleteModpack(c.req, {
                status: (code) => ({ json: (data) => resolve(jsonWithStatus(c, data, code)) }),
                json: (data) => resolve(c.json(data)),
                send: () => resolve(c.body(null, 204)),
            }, () => { });
        });
    });
}
// Añadir colaborador
function addCollaboratorHono(c) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get('user');
        const body = yield c.req.json();
        c.req.user = user;
        c.req.body = body;
        c.req.params = { modpackId: c.req.param('modpackId') };
        return yield new Promise((resolve) => {
            UserModpacksController_1.UserModpacksController.addCollaborator(c.req, {
                status: (code) => ({ json: (data) => resolve(jsonWithStatus(c, data, code)) }),
                json: (data) => resolve(c.json(data)),
                send: () => resolve(c.body(null, 204)),
            }, () => { });
        });
    });
}
// Eliminar colaborador
function removeCollaboratorHono(c) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = c.get('user');
        c.req.user = user;
        c.req.params = { modpackId: c.req.param('modpackId'), userId: c.req.param('userId') };
        return yield new Promise((resolve) => {
            UserModpacksController_1.UserModpacksController.removeCollaborator(c.req, {
                status: (code) => ({ json: (data) => resolve(jsonWithStatus(c, data, code)) }),
                json: (data) => resolve(c.json(data)),
                send: () => resolve(c.body(null, 204)),
            }, () => { });
        });
    });
}
exports.default = modpackRoutes;
