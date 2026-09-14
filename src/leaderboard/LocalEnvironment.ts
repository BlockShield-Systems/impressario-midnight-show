const LOCAL_IPV6_HOSTS = new Set([
  "::1",
  "0:0:0:0:0:0:0:1"
]);

function isIpv4Loopback(
  hostname: string
): boolean {
  const octets = hostname.split(".");

  return octets.length === 4 &&
    octets[0] === "127" &&
    octets.every(octet =>
      /^\d{1,3}$/.test(octet) &&
      Number(octet) <= 255
    );
}

export function isLocalDevelopmentHostname(
  hostname: string
): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");

  return normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    isIpv4Loopback(normalized) ||
    LOCAL_IPV6_HOSTS.has(normalized);
}
