"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Modpack Store API',
        version: '1.0.0',
        description: 'API documentation for the Modpack Store backend services.',
        contact: {
            name: 'API Support',
            url: 'https://example.com/support',
            email: 'support@example.com',
        },
        license: {
            name: 'ISC',
            url: 'https://opensource.org/licenses/ISC',
        },
    },
    servers: [
        {
            url: '/v1', // Base path for V1 routes
            description: 'Version 1 Development Server',
        },
        // Add other servers like production if needed
        // {
        //   url: 'https://api.example.com/v1',
        //   description: 'Production Server V1',
        // }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT', // Optional, for documentation purposes
                description: 'Enter JWT Bearer token **_only_**',
            },
            // TODO: Add other security schemes if needed, e.g., OAuth2 for Discord
            // discordOAuth: {
            //   type: 'oauth2',
            //   flows: {
            //     authorizationCode: {
            //       authorizationUrl: 'https://discord.com/api/oauth2/authorize',
            //       tokenUrl: 'https://discord.com/api/oauth2/token', // This is a simplification, actual token exchange happens server-side
            //       scopes: {
            //         identify: 'Allows us to read your Discord username and avatar',
            //         guilds: 'Allows us to check which servers you are in'
            //       }
            //     }
            //   }
            // }
        },
        schemas: {
            // Generic JSON:API Error Structures
            JsonApiError: {
                type: 'object',
                required: ['status', 'title', 'detail'],
                properties: {
                    status: { type: 'string', description: 'HTTP status code applicable to this problem.' },
                    title: { type: 'string', description: 'A short, human-readable summary of the problem.' },
                    detail: { type: 'string', description: 'A human-readable explanation specific to this occurrence of the problem.' },
                    code: { type: 'string', description: 'An application-specific error code, expressed as a string value (optional).' },
                    source: {
                        type: 'object',
                        properties: {
                            pointer: { type: 'string', description: 'A JSON Pointer [RFC6901] to the associated entity in the request document [e.g. "/data" for a primary data object, or "/data/attributes/title" for a specific attribute].' },
                            parameter: { type: 'string', description: 'A string indicating which URI query parameter caused the error.' },
                        },
                        description: 'An object containing references to the source of the error (optional).',
                    },
                    meta: { type: 'object', description: 'A meta object containing non-standard meta-information about the error (optional).', additionalProperties: true },
                },
            },
            JsonApiErrorResponse: {
                type: 'object',
                properties: {
                    errors: {
                        type: 'array',
                        items: {
                            $ref: '#/components/schemas/JsonApiError',
                        },
                    },
                },
            },
            JsonApiLink: {
                type: 'object',
                properties: {
                    href: { type: 'string', format: 'uri-reference' },
                    meta: { type: 'object', additionalProperties: true }
                },
                description: 'A link related to the resource or response.'
            },
            JsonApiLinks: {
                type: 'object',
                properties: {
                    self: { $ref: '#/components/schemas/JsonApiLink' },
                    related: { $ref: '#/components/schemas/JsonApiLink' }
                    // other common links like 'first', 'last', 'next', 'prev' for collections
                },
                additionalProperties: { $ref: '#/components/schemas/JsonApiLink' },
            },
            JsonApiResourceIdentifier: {
                type: 'object',
                required: ['type', 'id'],
                properties: {
                    type: { type: 'string', description: 'The resource type.' },
                    id: { type: 'string', description: 'The resource ID.' },
                    meta: { type: 'object', additionalProperties: true, description: 'Non-standard meta-information about the resource identifier.' }
                }
            },
            JsonApiRelationshipToOne: {
                type: 'object',
                properties: {
                    links: { $ref: '#/components/schemas/JsonApiLinks' },
                    data: { $ref: '#/components/schemas/JsonApiResourceIdentifier' }
                }
            },
            JsonApiRelationshipToMany: {
                type: 'object',
                properties: {
                    links: { $ref: '#/components/schemas/JsonApiLinks' },
                    data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/JsonApiResourceIdentifier' }
                    },
                    meta: {
                        type: 'object',
                        properties: {
                            count: { type: 'integer' }
                        }
                    }
                }
            },
            // --- Specific Model Schemas (Attributes and Resources) ---
            // User Schemas
            UserAttributes: {
                type: 'object',
                properties: {
                    username: { type: 'string', example: 'User123' },
                    avatarUrl: { type: 'string', format: 'url', nullable: true, example: 'https://cdn.discordapp.com/avatars/userid/avatarhash.png' },
                    role: { type: 'string', enum: ['user', 'admin', 'moderator'], example: 'user' }, // Assuming User model has a role
                    // Do not include sensitive fields like passwordHash or email if not publicly exposed
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            UserResource: {
                type: 'object',
                required: ['type', 'id', 'attributes'],
                properties: {
                    type: { type: 'string', example: 'user' },
                    id: { type: 'string', format: 'uuid', example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' },
                    attributes: { $ref: '#/components/schemas/UserAttributes' },
                    links: { $ref: '#/components/schemas/JsonApiLinks' },
                    // relationships: { // Example: if user has related modpacks as author
                    //   type: 'object',
                    //   properties: {
                    //     createdModpacks: { $ref: '#/components/schemas/JsonApiRelationshipToMany' }
                    //   }
                    // }
                },
            },
            // Token Schemas (for auth responses)
            TokenAttributes: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    refreshToken: { type: 'string', example: 'def50200f2992d476e880663730f8...' },
                    expiresIn: { type: 'integer', example: 3600, description: 'Access token validity period in seconds.' },
                },
            },
            TokenResource: {
                type: 'object',
                required: ['type', 'id', 'attributes'],
                properties: {
                    type: { type: 'string', example: 'token' },
                    id: { type: 'string', description: 'Typically the user ID or session ID related to the token.', example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' },
                    attributes: { $ref: '#/components/schemas/TokenAttributes' },
                    relationships: {
                        type: 'object',
                        properties: {
                            user: { $ref: '#/components/schemas/JsonApiRelationshipToOne', description: 'The user this token belongs to.' }
                        }
                    }
                }
            },
            // Publisher Schemas
            PublisherAttributes: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'Awesome Modding Inc.' },
                    slug: { type: 'string', example: 'awesome-modding-inc' },
                    description: { type: 'string', nullable: true, example: 'Creators of awesome mods.' },
                    websiteUrl: { type: 'string', format: 'url', nullable: true, example: 'https://awesome-modding.com' },
                    logoUrl: { type: 'string', format: 'url', nullable: true, example: 'https://cdn.example.com/logos/publisher.png' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            PublisherResource: {
                type: 'object',
                required: ['type', 'id', 'attributes'],
                properties: {
                    type: { type: 'string', example: 'publisher' },
                    id: { type: 'string', format: 'uuid' },
                    attributes: { $ref: '#/components/schemas/PublisherAttributes' },
                    links: { $ref: '#/components/schemas/JsonApiLinks' },
                    // relationships: {
                    //   type: 'object',
                    //   properties: {
                    //     members: { $ref: '#/components/schemas/JsonApiRelationshipToMany' },
                    //     modpacks: { $ref: '#/components/schemas/JsonApiRelationshipToMany' }
                    //   }
                    // }
                },
            },
            NewPublisherAttributes: {
                type: 'object',
                required: ['name', 'slug'],
                properties: {
                    name: { type: 'string', example: 'Awesome Modding Inc.' },
                    slug: { type: 'string', example: 'awesome-modding-inc', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
                    description: { type: 'string', nullable: true, example: 'Creators of awesome mods.' },
                    websiteUrl: { type: 'string', format: 'url', nullable: true, example: 'https://awesome-modding.com' },
                    logoUrl: { type: 'string', format: 'url', nullable: true, example: 'https://cdn.example.com/logos/publisher.png' },
                }
            },
            UpdatePublisherAttributes: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'Awesome Modding Inc.' },
                    slug: { type: 'string', example: 'awesome-modding-inc', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
                    description: { type: 'string', nullable: true, example: 'Creators of awesome mods.' },
                    websiteUrl: { type: 'string', format: 'url', nullable: true, example: 'https://awesome-modding.com' },
                    logoUrl: { type: 'string', format: 'url', nullable: true, example: 'https://cdn.example.com/logos/publisher.png' },
                }
            },
            // Modpack Schemas
            ModpackAttributes: {
                type: 'object',
                properties: {
                    name: { type: 'string', example: 'My Awesome Modpack' },
                    slug: { type: 'string', example: 'my-awesome-modpack' },
                    shortDescription: { type: 'string', nullable: true, example: 'A brief summary of the modpack.' },
                    description: { type: 'string', nullable: true, example: 'A detailed description of the modpack content.' },
                    visibility: { type: 'string', enum: ['public', 'private', 'unlisted'], example: 'public' },
                    status: { type: 'string', enum: ['draft', 'published', 'archived', 'disabled', 'deleted'], example: 'published' },
                    iconUrl: { type: 'string', format: 'url', nullable: true },
                    bannerUrl: { type: 'string', format: 'url', nullable: true },
                    trailerUrl: { type: 'string', format: 'url', nullable: true },
                    showUserAsPublisher: { type: 'boolean', default: false },
                    downloads: { type: 'integer', example: 1500, readOnly: true }, // Example read-only field
                    // password field should not be here as it's write-only and not returned
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    publishedAt: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            ModpackResource: {
                type: 'object',
                required: ['type', 'id', 'attributes'],
                properties: {
                    type: { type: 'string', example: 'modpack' },
                    id: { type: 'string', format: 'uuid' },
                    attributes: { $ref: '#/components/schemas/ModpackAttributes' },
                    links: { $ref: '#/components/schemas/JsonApiLinks' },
                    relationships: {
                        type: 'object',
                        properties: {
                            publisher: { $ref: '#/components/schemas/JsonApiRelationshipToOne' },
                            creator: { $ref: '#/components/schemas/JsonApiRelationshipToOne' },
                            versions: { $ref: '#/components/schemas/JsonApiRelationshipToMany' },
                            // categories: { $ref: '#/components/schemas/JsonApiRelationshipToMany' }
                        }
                    }
                },
            },
            NewModpackAttributes: {
                type: 'object',
                required: ['publisherId', 'name', 'slug', 'visibility'],
                properties: {
                    publisherId: { type: 'string', format: 'uuid', description: 'ID of the publisher this modpack belongs to.' },
                    name: { type: 'string', minLength: 3, maxLength: 64 },
                    slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', minLength: 3, maxLength: 64 },
                    shortDescription: { type: 'string', maxLength: 255, nullable: true },
                    description: { type: 'string', nullable: true },
                    visibility: { type: 'string', enum: ['public', 'private', 'unlisted'], default: 'private' },
                    iconUrl: { type: 'string', format: 'url', nullable: true },
                    bannerUrl: { type: 'string', format: 'url', nullable: true },
                    trailerUrl: { type: 'string', format: 'url', nullable: true },
                    password: { type: 'string', minLength: 4, nullable: true, description: 'Required if visibility is private and password-protected.' },
                    showUserAsPublisher: { type: 'boolean', default: false }
                }
            },
            UpdateModpackAttributes: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 3, maxLength: 64 },
                    // slug cannot be updated generally, or requires special handling
                    shortDescription: { type: 'string', maxLength: 255, nullable: true },
                    description: { type: 'string', nullable: true },
                    visibility: { type: 'string', enum: ['public', 'private', 'unlisted'] },
                    status: { type: 'string', enum: ['draft', 'published', 'archived'] }, // Limited statuses for user update
                    iconUrl: { type: 'string', format: 'url', nullable: true },
                    bannerUrl: { type: 'string', format: 'url', nullable: true },
                    trailerUrl: { type: 'string', format: 'url', nullable: true },
                    password: { type: 'string', minLength: 4, nullable: true, description: 'Set to null or empty string to remove password.' },
                    showUserAsPublisher: { type: 'boolean' }
                }
            },
            // ModpackVersion Schemas
            ModpackVersionAttributes: {
                type: 'object',
                properties: {
                    version: { type: 'string', example: '1.0.0' },
                    mcVersion: { type: 'string', example: '1.18.2', nullable: true },
                    forgeVersion: { type: 'string', example: '40.1.0', nullable: true },
                    changelog: { type: 'string', nullable: true },
                    status: { type: 'string', enum: ['draft', 'published', 'archived', 'processing', 'failed'], example: 'published' },
                    fileUrl: { type: 'string', format: 'url', nullable: true, readOnly: true }, // Assuming file URL is provided after upload
                    fileSize: { type: 'integer', nullable: true, readOnly: true, description: 'File size in bytes.' },
                    downloads: { type: 'integer', example: 500, readOnly: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    publishedAt: { type: 'string', format: 'date-time', nullable: true },
                    releaseDate: { type: 'string', format: 'date-time', nullable: true }
                },
            },
            ModpackVersionResource: {
                type: 'object',
                required: ['type', 'id', 'attributes'],
                properties: {
                    type: { type: 'string', example: 'modpackVersion' },
                    id: { type: 'string', format: 'uuid' },
                    attributes: { $ref: '#/components/schemas/ModpackVersionAttributes' },
                    links: { $ref: '#/components/schemas/JsonApiLinks' },
                    relationships: {
                        type: 'object',
                        properties: {
                            modpack: { $ref: '#/components/schemas/JsonApiRelationshipToOne' },
                            creator: { $ref: '#/components/schemas/JsonApiRelationshipToOne' },
                            // dependencies: { $ref: '#/components/schemas/JsonApiRelationshipToMany' }
                        }
                    }
                },
            },
            NewModpackVersionAttributes: {
                type: 'object',
                required: ['version'],
                properties: {
                    version: { type: 'string', example: '1.0.1', description: "Semantic versioning (e.g., 1.0.0, 2.3.4-beta.1)" },
                    mcVersion: { type: 'string', example: '1.19.2', nullable: true },
                    forgeVersion: { type: 'string', example: '43.2.0', nullable: true },
                    changelog: { type: 'string', nullable: true }
                }
            },
            UpdateModpackVersionAttributes: {
                type: 'object',
                properties: {
                    mcVersion: { type: 'string', nullable: true },
                    forgeVersion: { type: 'string', nullable: true },
                    changelog: { type: 'string', nullable: true },
                    status: { type: 'string', enum: ['draft', 'published', 'archived'] }, // Limited statuses for user update
                    releaseDate: { type: 'string', format: 'date-time', nullable: true }
                }
            },
            // Admin specific schemas
            AdminUpdateUserAttributes: {
                type: 'object',
                description: "Attributes for an admin to update a user's profile.",
                properties: {
                    username: { type: 'string', example: 'UserModified123', description: "User's username. Must be unique." },
                    role: { type: 'string', enum: ['user', 'moderator', 'admin'], description: "User's role in the system." },
                    // Other fields an admin might be allowed to change, e.g., email, account status (active/banned)
                    // For example:
                    // email: { type: 'string', format: 'email', example: 'user@example.com' },
                    // accountStatus: { type: 'string', enum: ['active', 'suspended', 'banned'], example: 'active' }
                }
            },
            AdminUpdateModpackAttributes: {
                type: 'object',
                description: "Attributes for an admin to update a modpack. Admins may have more privileges, e.g., changing status directly.",
                properties: {
                    name: { type: 'string', minLength: 3, maxLength: 64 },
                    slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', minLength: 3, maxLength: 64, description: "URL-friendly slug. Careful if changing as it affects links." },
                    shortDescription: { type: 'string', maxLength: 255, nullable: true },
                    description: { type: 'string', nullable: true },
                    visibility: { type: 'string', enum: ['public', 'private', 'unlisted'] },
                    status: { type: 'string', enum: ['draft', 'published', 'archived', 'disabled', 'deleted'], description: "Admin can set a wider range of statuses." },
                    iconUrl: { type: 'string', format: 'url', nullable: true },
                    bannerUrl: { type: 'string', format: 'url', nullable: true },
                    trailerUrl: { type: 'string', format: 'url', nullable: true },
                    showUserAsPublisher: { type: 'boolean' },
                    publisherId: { type: 'string', format: 'uuid', description: "Reassign modpack to a different publisher." },
                    creatorUserId: { type: 'string', format: 'uuid', description: "Reassign modpack to a different creator." }
                }
            },
            // Collaborator Schemas
            CollaboratorAttributes: {
                type: 'object',
                properties: {
                    role: { type: 'string', enum: ['owner', 'editor', 'viewer'], example: 'editor', description: "Role of the collaborator on the modpack." },
                    // User details are typically included via a relationship
                }
            },
            CollaboratorResource: {
                type: 'object',
                required: ['type', 'id', 'attributes', 'relationships'],
                properties: {
                    type: { type: 'string', example: 'collaborator' },
                    id: { type: 'string', format: 'uuid', description: "This would typically be the UserID of the collaborator." },
                    attributes: { $ref: '#/components/schemas/CollaboratorAttributes' },
                    relationships: {
                        type: 'object',
                        properties: {
                            user: { $ref: '#/components/schemas/JsonApiRelationshipToOne', description: "The user who is the collaborator." },
                            modpack: { $ref: '#/components/schemas/JsonApiRelationshipToOne', description: "The modpack they collaborate on." }
                        }
                    }
                }
            },
            AddCollaboratorRequestAttributes: {
                type: 'object',
                required: ['userId', 'role'],
                properties: {
                    userId: { type: 'string', format: 'uuid', description: "ID of the user to add as a collaborator." },
                    role: { type: 'string', enum: ['owner', 'editor', 'viewer'], example: 'editor' }
                }
            },
            // Logo Upload Response (could be part of ModpackResource or a simple link)
            LogoUploadResponse: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            type: { type: 'string', example: 'modpackLogo' },
                            id: { type: 'string', format: 'uuid', description: "Modpack ID" },
                            attributes: {
                                type: 'object',
                                properties: {
                                    iconUrl: { type: 'string', format: 'url', description: "New URL of the uploaded logo." }
                                }
                            },
                            links: { $ref: '#/components/schemas/JsonApiLinks' }
                        }
                    }
                }
            },
            // Version File Upload response
            VersionFileUploadResponse: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            type: { type: 'string', example: 'modpackVersionFile' },
                            id: { type: 'string', format: 'uuid', description: "ModpackVersion ID" },
                            attributes: {
                                type: 'object',
                                properties: {
                                    fileUrl: { type: 'string', format: 'url', description: "New URL of the uploaded version file." },
                                    fileSize: { type: 'integer', description: "Size of the uploaded file in bytes." }
                                }
                            },
                            links: { $ref: '#/components/schemas/JsonApiLinks' }
                        }
                    }
                }
            }
        },
    },
    tags: [
        { name: 'Auth', description: 'Authentication related endpoints' },
        { name: 'Explore', description: 'Endpoints for exploring modpacks' },
        { name: 'Modpacks', description: 'Modpack management endpoints' },
        { name: 'Versions', description: 'Modpack version management endpoints' },
        { name: 'Admin', description: 'Admin-only endpoints for managing users and publishers' },
        // { name: 'AdminUsers', description: 'Admin User Management (subset of Admin)' },
        // { name: 'AdminPublishers', description: 'Admin Publisher Management (subset of Admin)' },
    ],
};
const options = {
    swaggerDefinition,
    // Paths to files containing OpenAPI definitions (JSDoc comments)
    apis: [
        './src/routes/v1/*.ts',
        './src/controllers/**/*.ts', // If JSDoc is in controllers too (less common for routes)
        './src/models/**/*.ts' // If models contain schema definitions (useful for request/response bodies)
    ],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(options);
exports.default = swaggerSpec;
