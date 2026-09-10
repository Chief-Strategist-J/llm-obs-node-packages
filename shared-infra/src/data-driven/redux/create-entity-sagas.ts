import { call, put, takeEvery } from 'redux-saga/effects';
import { eventBus } from '../../event-bus';
import type { CrudPort } from '../adapters/create-entity-adapter';

export function createEntitySagas<T extends { id: string }>(name: string, adapter: CrudPort<T>, slice: any) {
  function* fetchAll() {
    yield put(slice.actions.setStatus('loading'));
    try {
      const items: readonly T[] = yield call(adapter.list);
      yield put(slice.actions.setAll(items));
      yield put(slice.actions.setStatus('idle'));
    } catch {
      yield put(slice.actions.setStatus('error'));
    }
  }
  function* createOne(action: { payload: Partial<T> }) {
    const item: T = yield call(adapter.create, action.payload);
    yield put(slice.actions.upsertOne(item));
    eventBus.emit(`${name}.created`, item);
  }
  function* removeOne(action: { payload: string }) {
    yield call(adapter.remove, action.payload);
    yield put(slice.actions.removeOne(action.payload));
    eventBus.emit(`${name}.removed`, { id: action.payload });
  }
  return function* rootSaga() {
    yield takeEvery(`${name}/fetchAll` as any, fetchAll);
    yield takeEvery(`${name}/createOne` as any, createOne);
    yield takeEvery(`${name}/removeOne` as any, removeOne);
  };
}
