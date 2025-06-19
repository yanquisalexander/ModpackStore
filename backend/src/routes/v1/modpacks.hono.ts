import { Hono } from 'hono';
import type { Context } from 'hono';
import { UserModpacksController } from '../../controllers/UserModpacksController';
import { requireAuth } from '@/middlewares';

const modpackRoutes = new Hono();

// Utilidad para status code en Hono
function jsonWithStatus(c: Context, data: any, code: number) {
    return c.json(data, code as any);
}

// Adaptadores Hono para los controladores Express
async function createModpackHono(c: Context) {
    const user = c.get('user');
    const body = await c.req.json();
    (c.req as any).user = user;
    (c.req as any).body = body;
    return await new Promise((resolve) => {
        UserModpacksController.createModpack(c.req as any, {
            status: (code: number) => ({ json: (data: any) => resolve(jsonWithStatus(c, data, code)) }),
            json: (data: any) => resolve(c.json(data)),
            send: () => resolve(c.body(null, 204)),
        }, () => { });
    }) as Response;
}

async function listUserModpacksHono(c: Context) {
    const user = c.get('user');
    (c.req as any).user = user;
    return await new Promise((resolve) => {
        UserModpacksController.listUserModpacks(c.req as any, {
            status: (code: number) => ({ json: (data: any) => resolve(jsonWithStatus(c, data, code)) }),
            json: (data: any) => resolve(c.json(data)),
            send: () => resolve(c.body(null, 204)),
        }, () => { });
    }) as Response;
}

async function getModpackHono(c: Context) {
    const user = c.get('user');
    (c.req as any).user = user;
    (c.req as any).params = { modpackId: c.req.param('modpackId') };
    return await new Promise((resolve) => {
        (UserModpacksController as any).getModpack(c.req as any, {
            status: (code: number) => ({ json: (data: any) => resolve(jsonWithStatus(c, data, code)) }),
            json: (data: any) => resolve(c.json(data)),
            send: () => resolve(c.body(null, 204)),
        }, () => { });
    }) as Response;
}

async function updateModpackHono(c: Context) {
    const user = c.get('user');
    const body = await c.req.json();
    (c.req as any).user = user;
    (c.req as any).body = body;
    (c.req as any).params = { modpackId: c.req.param('modpackId') };
    return await new Promise((resolve) => {
        UserModpacksController.updateModpack(c.req as any, {
            status: (code: number) => ({ json: (data: any) => resolve(jsonWithStatus(c, data, code)) }),
            json: (data: any) => resolve(c.json(data)),
            send: () => resolve(c.body(null, 204)),
        }, () => { });
    }) as Response;
}

async function deleteModpackHono(c: Context) {
    const user = c.get('user');
    (c.req as any).user = user;
    (c.req as any).params = { modpackId: c.req.param('modpackId') };
    return await new Promise((resolve) => {
        UserModpacksController.deleteModpack(c.req as any, {
            status: (code: number) => ({ json: (data: any) => resolve(jsonWithStatus(c, data, code)) }),
            json: (data: any) => resolve(c.json(data)),
            send: () => resolve(c.body(null, 204)),
        }, () => { });
    }) as Response;
}

// Añadir colaborador
async function addCollaboratorHono(c: Context) {
    const user = c.get('user');
    const body = await c.req.json();
    (c.req as any).user = user;
    (c.req as any).body = body;
    (c.req as any).params = { modpackId: c.req.param('modpackId') };
    return await new Promise((resolve) => {
        (UserModpacksController as any).addCollaborator(c.req as any, {
            status: (code: number) => ({ json: (data: any) => resolve(jsonWithStatus(c, data, code)) }),
            json: (data: any) => resolve(c.json(data)),
            send: () => resolve(c.body(null, 204)),
        }, () => { });
    }) as Response;
}

// Eliminar colaborador
async function removeCollaboratorHono(c: Context) {
    const user = c.get('user');
    (c.req as any).user = user;
    (c.req as any).params = { modpackId: c.req.param('modpackId'), userId: c.req.param('userId') };
    return await new Promise((resolve) => {
        (UserModpacksController as any).removeCollaborator(c.req as any, {
            status: (code: number) => ({ json: (data: any) => resolve(jsonWithStatus(c, data, code)) }),
            json: (data: any) => resolve(c.json(data)),
            send: () => resolve(c.body(null, 204)),
        }, () => { });
    }) as Response;
}


export default modpackRoutes;
