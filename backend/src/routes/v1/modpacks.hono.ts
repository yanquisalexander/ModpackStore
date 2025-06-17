import { Hono } from 'hono';
import type { Context } from 'hono';
import { UserModpacksController } from '../../controllers/UserModpacksController';
import { requireAuth } from '@/middlewares';
import { checkModpackPermissionHono, Permission } from '@/middlewares/checkModpackPermission.hono';

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

// Crear modpack (requiere permiso de creación)
modpackRoutes.post('/', requireAuth, checkModpackPermissionHono(['canCreateModpacks']), createModpackHono);
// Listar modpacks del usuario (solo autenticación)
modpackRoutes.get('/', requireAuth, listUserModpacksHono);
// Obtener modpack específico (requiere permiso de edición)
modpackRoutes.get('/:modpackId', requireAuth, checkModpackPermissionHono(['canEditModpacks']), getModpackHono);
// Actualizar modpack
modpackRoutes.patch('/:modpackId', requireAuth, checkModpackPermissionHono(['canEditModpacks']), updateModpackHono);
// Eliminar modpack
modpackRoutes.delete('/:modpackId', requireAuth, checkModpackPermissionHono(['canDeleteModpacks']), deleteModpackHono);
// Añadir colaborador
modpackRoutes.post('/:modpackId/collaborators', requireAuth, checkModpackPermissionHono(['canManageMembers']), addCollaboratorHono);
// Eliminar colaborador
modpackRoutes.delete('/:modpackId/collaborators/:userId', requireAuth, checkModpackPermissionHono(['canManageMembers']), removeCollaboratorHono);

export default modpackRoutes;
