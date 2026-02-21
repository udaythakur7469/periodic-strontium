import { DeterministicStateError } from './errors.js';

export type RequestState = 'IDLE' | 'PENDING' | 'RETRYING' | 'SUCCESS' | 'ERROR' | 'CANCELLED';

const ALLOWED_TRANSITIONS: Record<RequestState, RequestState[]> = {
  IDLE: ['PENDING', 'CANCELLED'],
  PENDING: ['SUCCESS', 'ERROR', 'RETRYING', 'CANCELLED'],
  RETRYING: ['PENDING', 'SUCCESS', 'ERROR', 'CANCELLED'],
  SUCCESS: [],
  ERROR: [],
  CANCELLED: [],
};

export class StateMachine {
  private state: RequestState = 'IDLE';

  getState(): RequestState {
    return this.state;
  }

  transition(next: RequestState): void {
    const allowed = ALLOWED_TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      throw new DeterministicStateError(this.state, next);
    }
    this.state = next;
  }

  isTerminal(): boolean {
    return ['SUCCESS', 'ERROR', 'CANCELLED'].includes(this.state);
  }
}
