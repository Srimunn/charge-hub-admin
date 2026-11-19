/**
 * Socket.io helpers.
 *
 * Rooms:
 *   user:<userId>     – private events for one user (customer or owner)
 *   admin             – every platform admin
 *   station:<id>      – anyone viewing that station (public live telemetry only)
 *
 * Sockets authenticate by passing the JWT as `auth.token` (or `?token=`). Unauthenticated
 * sockets still receive public station status updates and can join station rooms.
 */
let io = null;

export const setIo = (instance) => {
  io = instance;
};
export const getIo = () => io;

const ownerOf = (station) => station?.userId;

/** Event for the station's owner + all admins (operator dashboards). */
export const emitToOperators = (station, event, payload) => {
  if (!io) return;
  let target = io.to("admin");
  const owner = ownerOf(station);
  if (owner) target = target.to(`user:${owner}`);
  target.emit(event, payload);
};

/** Event for operators of the station and the given user (e.g. the charging customer). */
export const emitToOperatorsAndUser = (station, userId, event, payload) => {
  if (!io) return;
  let target = io.to("admin");
  const owner = ownerOf(station);
  if (owner) target = target.to(`user:${owner}`);
  if (userId) target = target.to(`user:${userId}`);
  target.emit(event, payload);
};

export const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

/** Non-sensitive station status, visible to everyone (station list / map in the app). */
export const emitPublicStation = (station, event, payload) => {
  if (!io) return;
  io.emit(event, payload);
  if (station?.id) io.to(`station:${station.id}`).emit(`${event}`, payload);
};

/** Live charger readings for a station room plus its operators. */
export const emitStationRoom = (station, event, payload) => {
  if (!io || !station) return;
  let target = io.to(`station:${station.id}`).to("admin");
  if (station.userId) target = target.to(`user:${station.userId}`);
  target.emit(event, payload);
};
