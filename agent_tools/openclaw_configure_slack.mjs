import fs from "node:fs";

const [, , configPath = "/data/openclaw.json", channelId = ""] = process.argv;

if (!channelId) {
  throw new Error("channel id requerido");
}

const appToken = process.env.SLACK_APP_TOKEN || "";
const botToken = process.env.SLACK_BOT_TOKEN || "";

if (!appToken || !botToken) {
  throw new Error("SLACK_APP_TOKEN y SLACK_BOT_TOKEN deben estar en el entorno");
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.channels = config.channels || {};
config.channels.slack = {
  enabled: true,
  mode: "socket",
  appToken,
  botToken,
  dmPolicy: "pairing",
  dm: { enabled: true },
  channels: {
    [channelId]: {},
  },
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`Slack nativo habilitado para ${channelId}`);


