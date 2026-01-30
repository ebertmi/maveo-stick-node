import createDebug from 'debug';

export const debug = {
  auth: createDebug('maveo:auth'),
  mqtt: createDebug('maveo:mqtt'),
  client: createDebug('maveo:client'),
};
