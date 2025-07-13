export type UnregisterRequest = {
    id: number;
};

export type NewWorkerRequest = {
    id?: number;
    host: string;
    port: number;
};

export type NewWorkerResponse = {
    id: number;
};