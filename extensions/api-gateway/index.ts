import { definePluginEntry, type OpenClawPluginApi } from "./runtime-api.js";
import { createApiGatewayService } from "./server.js";

export default definePluginEntry({
  id: "api-gateway",
  name: "API Gateway",
  description: "Standalone RESTful API gateway for OpenClaw runtime integration.",
  register(api: OpenClawPluginApi) {
    api.registerService(createApiGatewayService(api.runtime));
  },
});
