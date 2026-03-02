import { SocketGateway } from "./net/SocketGateway";

const parsedPort = Number(process.env.PORT);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3001;
const gateway = new SocketGateway(port);
gateway.start();