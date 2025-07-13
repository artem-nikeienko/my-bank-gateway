export type ErrorResponse = {
    errorMessage: string;
}

export type ApiResponse<T> =  
    | { success: true; data: T }
    | { success: false; error: string };