# spirit/type/string/signature/test/script.js

The type of a signature (goal/G49.25, Q13; Andy: "i agree to a signature type."), one for every signed argument on node and
relay alike. A signature is what spirit/relayAuth/script.js's sign() makes: six of them, two identities over three texts,
pass isValid with true, and so does its defaultValue. isValid throws for no string (undefined, null, 7, an object), for ""
and words, for a signature cut short, grown longer or holding a character that is no base64, and for a public key.
