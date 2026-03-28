import { PersistedState } from "runed";

const skipVerification = new PersistedState("skipVerification", false);
const geminiApiKey = new PersistedState("geminiApiKey", "");

export const preferences = {
  get skipVerification() {
    return skipVerification.current;
  },
  set skipVerification(value) {
    skipVerification.current = value;
  },
  get geminiApiKey() {
    return geminiApiKey.current;
  },
  set geminiApiKey(value) {
    geminiApiKey.current = value;
  },
};
