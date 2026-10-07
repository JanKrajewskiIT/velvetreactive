export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface MutationState<TData> {
  status: MutationStatus;
  data: TData | undefined;
  error: Error | undefined;
}

export interface MutationOptions<TData, TVariables, TContext = unknown> {
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (result: TData, variables: TVariables, context?: TContext) => void;
  onError?: (error: Error, variables: TVariables, context?: TContext) => void;
  onSettled?: (data: TData | undefined, error: Error | undefined, variables: TVariables, context?: TContext) => void;
}

export type MutationCallbacks<TData, TVariables, TContext = unknown> = MutationOptions<TData, TVariables, TContext>;
