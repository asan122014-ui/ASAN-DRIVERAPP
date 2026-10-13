export function classifyPushResults(tokens, responses) {
  const invalid = [], retry = [];
  responses.forEach((result, index) => {
    if (result.success) return;
    if (["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(result.error?.code)) invalid.push(tokens[index]);
    else retry.push(tokens[index]);
  });
  return { invalid, retry };
}
