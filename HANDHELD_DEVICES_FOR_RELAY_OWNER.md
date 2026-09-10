# Connecting additional devices owned by the owner of a relay.

I'm not much for IT "terminology". This is is in plain english. So i call a secret a **password**. I think there is a relatively simple way to allow in-browser peers on handheld devices owned by the same owner that owns the VPS RELAY.

## Setup as experienced by the owner of a RELAY

1. Any personal work node that owns any number of RELAYs owner
generates and stores one object containing a once-generated 128 character long password and a once-generated key pair.

2. the owner gets a user interface in his shell where he can "copy" the **password**.

3. Any RELAY has a reserved handle, **devices**, reserved for web browsers of the RELAYs owner, and an interface through which the owners personal node can stash the **password** in the RELAYs RAM. and set the public key for the handle **devices**, also in the RELAYs RAM.

4. The pamphlet page on the VPS relay presents a form containing only one field password form, that POSTs the password to the RELAY.

5. if the password sent by the browser matches the password maintained in the RELAYs RAM, the relay messages the owners personal a request for the device key, and replies, the the browsers request whith that key.

6. Now the browsers has everything it needs to communicate through the RELAY.

