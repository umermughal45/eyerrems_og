"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = __importDefault(require("../prisma/client"));
async function main() {
    const clients = await client_1.default.client.findMany({
        take: 5,
    });
    console.log('Clients:', JSON.stringify(clients, null, 2));
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await client_1.default.$disconnect();
});
//# sourceMappingURL=debug-clients.js.map