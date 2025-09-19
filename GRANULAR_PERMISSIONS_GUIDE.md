# 🔒 Granular Permissions System - User Guide

## Overview
The ModpackStore now includes a comprehensive granular permissions system that allows Publisher owners and administrators to control exactly what each team member can do with modpacks and publisher settings.

## Permission Hierarchy

### 👑 Owner (Propietario)
- **Permissions**: Complete and **immutable** access to everything
- **Cannot be**: Modified, demoted, or restricted
- **Can manage**: All roles, all permissions, all settings
- **Unique**: Only one owner per publisher

### 👮 Admin (Administrador)  
- **Permissions**: Complete access to everything (manageable by Owner)
- **Can be**: Modified by Owner only
- **Can manage**: Members but not other Admins or Owner
- **Limitations**: Cannot modify Owner permissions

### 👤 Member (Miembro)
- **Permissions**: Limited by default, requires explicit permission grants
- **Can be**: Managed by Owner or Admin
- **Default access**: Only modpacks they created
- **Customizable**: Granular permissions can be assigned

## Granular Permissions

### Modpack-Level Permissions
These permissions can be assigned per individual modpack:

| Permission | Description | Icon |
|------------|-------------|------|
| **Ver** (`modpack.view`) | Can view the modpack | 👁️ |
| **Modificar** (`modpack.modify`) | Can edit modpack details | ✏️ |
| **Gestionar Versiones** (`modpack.manage_versions`) | Can add, edit, delete versions | 🌿 |
| **Publicar** (`modpack.publish`) | Can change status from draft to published | 📤 |
| **Eliminar** (`modpack.delete`) | Can delete the modpack | 🗑️ |
| **Gestionar Acceso** (`modpack.manage_access`) | Can assign permissions to other members | 🛡️ |

### Publisher-Level Permissions
These permissions apply to the entire publisher organization:

| Permission | Description | Icon |
|------------|-------------|------|
| **Gestionar Categorías y Etiquetas** (`publisher.manage_categories_tags`) | Can manage publisher categories and tags | 🏷️ |
| **Ver Estadísticas** (`publisher.view_stats`) | Can view download and sales statistics | 📊 |

## How to Use

### 1. Accessing Permission Management
1. Navigate to your Publisher dashboard
2. Click on the **"Permisos Granulares"** tab in the sidebar
3. You'll see a list of all members with their current roles and permissions

### 2. Assigning Permissions to Members
1. Find the member you want to modify (only Members can have granular permissions)
2. Click the **"+ Permisos"** button next to their name
3. Choose the permission type:
   - **Publisher Permissions**: Apply to the entire organization
   - **Modpack Permissions**: Apply to a specific modpack
4. Select the specific permissions you want to grant
5. Click **"Asignar Permisos"**

### 3. Changing Member Roles
1. Find the member in the permissions table
2. Use the role dropdown next to their name
3. Select the new role (Admin or Member)
4. Changes take effect immediately

### 4. Removing Permissions
1. Find the permission scope you want to remove
2. Click the **"X"** button next to the permission badge
3. Confirm the removal

## Best Practices

### 🎯 Start with Least Privilege
- Begin by assigning minimal permissions
- Add permissions as needed based on actual requirements
- Regularly review and audit permissions

### 🔄 Use Role-Based Assignment
- Use **Admin** role for trusted team members who need full access
- Use **Member** role with specific permissions for limited access
- Keep **Owner** role for the publisher creator only

### 📝 Document Permission Changes
- Keep track of who has what permissions
- Document the reason for permission grants
- Regular permission audits for larger teams

### 🛡️ Security Considerations
- **Owner permissions are immutable** - cannot be changed or restricted
- **Admin permissions can only be modified by Owner**
- **Member permissions are fully customizable**
- **Permission changes are logged** for audit purposes

## API Endpoints

For developers integrating with the permission system:

### Get Members and Permissions
```http
GET /v1/creators/publishers/{publisherId}/members
Authorization: Bearer {accessToken}
```

### Assign Permissions
```http
POST /v1/creators/publishers/{publisherId}/permissions
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "userId": "user-uuid",
  "permissions": {
    "modpackView": true,
    "modpackModify": false,
    "publisherViewStats": true
  },
  "modpackId": "modpack-uuid" // Optional: for modpack-specific permissions
}
```

### Change Member Role
```http
PATCH /v1/creators/publishers/{publisherId}/members/{memberId}/role
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "userId": "user-uuid",
  "role": "admin"
}
```

### Remove Permission Scope
```http
DELETE /v1/creators/publishers/{publisherId}/permissions/{scopeId}
Authorization: Bearer {accessToken}
```

## Migration from Previous System

The new system is **backward compatible** with the existing role-based system:

- **Existing Owners**: Automatically have all permissions (immutable)
- **Existing Admins**: Automatically have all permissions (manageable by Owner)
- **Existing Members**: Continue to see only their own modpacks until granted additional permissions

## Troubleshooting

### ❓ Member can't see a modpack
- Check if they have `modpack.view` permission for that specific modpack
- Verify they're not restricted to only their own created modpacks

### ❓ Admin can't manage another admin
- **By design**: Admins can only manage Members, not other Admins or the Owner

### ❓ Permission changes not taking effect
- Refresh the page or re-login
- Check if the user has the correct role (permissions only apply to Members)

### ❓ Can't modify Owner permissions
- **By design**: Owner permissions are immutable and cannot be changed

## Support

For technical support or questions about the permission system:
1. Check this documentation first
2. Review the API endpoints for integration questions
3. Contact the development team for system issues

---

🎉 **The granular permissions system provides fine-grained control over team access while maintaining security and simplicity!**