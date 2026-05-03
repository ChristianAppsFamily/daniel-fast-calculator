/**
 * Adds the App Group entitlement required for shared `UserDefaults` between
 * the iOS host app and the watchOS companion (configure the same group on the watch targets in Xcode).
 */
const { withEntitlementsPlist } = require('@expo/config-plugins');

const APP_GROUP = 'group.com.christianappempire.danielfast';

function withAppGroupEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    const existing = config.modResults['com.apple.security.application-groups'];
    const next = Array.isArray(existing) ? [...existing] : [];
    if (!next.includes(APP_GROUP)) {
      next.push(APP_GROUP);
    }
    config.modResults['com.apple.security.application-groups'] = next;
    return config;
  });
}

module.exports = withAppGroupEntitlements;
