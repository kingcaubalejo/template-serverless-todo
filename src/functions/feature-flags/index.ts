import { handlerPath } from "@libs/handler-resolver";

export const getAllFeatureFlags = {
    handler: `${handlerPath(__dirname)}/handler.getAllFeatureFlags`,
    events: [
        {
            http: {
                method: 'get',
                path: 'feature-flags',
            },
        },
    ],
};

export const getFeatureFlag = {
    handler: `${handlerPath(__dirname)}/handler.getFeatureFlag`,
    events: [
        {
            http: {
                method: 'get',
                path: 'feature-flags/{name}',
            },
        },
    ],
};

export const createFeatureFlag = {
    handler: `${handlerPath(__dirname)}/handler.createFeatureFlag`,
    events: [
        {
            http: {
                method: 'post',
                path: 'feature-flags',
            },
        },
    ],
};

export const updateFeatureFlag = {
    handler: `${handlerPath(__dirname)}/handler.updateFeatureFlag`,
    events: [
        {
            http: {
                method: 'put',
                path: 'feature-flags/{name}',
            },
        },
    ],
};

export const deleteFeatureFlag = {
    handler: `${handlerPath(__dirname)}/handler.deleteFeatureFlag`,
    events: [
        {
            http: {
                method: 'delete',
                path: 'feature-flags/{name}',
            },
        },
    ],
};

export const checkFeatureFlag = {
    handler: `${handlerPath(__dirname)}/handler.checkFeatureFlag`,
    events: [
        {
            http: {
                method: 'get',
                path: 'feature-flags/{name}/check',
            },
        },
    ],
};
