import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("Set these on the backend (Render > Environment):\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_CONTACT=mailto:you@yourdomain.com\n");
console.log("Keep the private key secret; do not commit it.");
