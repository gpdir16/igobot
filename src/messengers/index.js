import config from "../core/config.js";
import logger from "../utils/logger.js";
import TelegramMessenger from "./telegram/messenger.js";

const messengerFactories = new Map([["telegram", () => new TelegramMessenger()]]);

export function getRegisteredMessengerKeys() {
    return Array.from(messengerFactories.keys());
}

export function createEnabledMessengers() {
    const messengers = [];

    for (const key of config.messengers.enabled) {
        const factory = messengerFactories.get(key);
        if (!factory) {
            logger.warn(`Unsupported messenger configured: ${key}`);
            continue;
        }

        messengers.push(factory());
    }

    return messengers;
}

export { default as TelegramMessenger } from "./telegram/messenger.js";
