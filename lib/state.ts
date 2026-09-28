import type { AnalysisResult, AnalysisState, FormInput } from './types';
import { SAMPLE_FORM } from './sampleData';

/** 状态机动作 */
export type StateAction =
  | { type: 'UPDATE_FORM'; payload: Partial<FormInput> }
  | { type: 'LOAD_FORM'; payload: FormInput }
  | { type: 'START_LOADING' }
  | { type: 'SET_RESULT'; payload: AnalysisResult }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_HIDE_MOCK'; payload: boolean }
  | { type: 'RESET' };

export const initialState: AnalysisState = {
  status: 'input',
  form: SAMPLE_FORM,
  result: null,
  error: null,
  hideMock: false,
};

/**
 * 状态机：input → loading → result | error
 * - 只有 input/error 状态允许进入 loading
 * - updateForm / loadForm 会回到 input（清空旧结果）
 */
export function reducer(state: AnalysisState, action: StateAction): AnalysisState {
  switch (action.type) {
    case 'UPDATE_FORM':
      return {
        ...state,
        status: 'input',
        form: { ...state.form, ...action.payload },
        result: null,
        error: null,
      };

    case 'LOAD_FORM':
      return {
        ...state,
        status: 'input',
        form: action.payload,
        result: null,
        error: null,
      };

    case 'START_LOADING':
      // 已在加载中则忽略；input/result/error 均可进入 loading（result 用于「重新运行」）
      if (state.status === 'loading') return state;
      return { ...state, status: 'loading', error: null };

    case 'SET_RESULT':
      return {
        ...state,
        status: 'result',
        result: action.payload,
        error: null,
      };

    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload };

    case 'SET_HIDE_MOCK':
      return { ...state, hideMock: action.payload };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}