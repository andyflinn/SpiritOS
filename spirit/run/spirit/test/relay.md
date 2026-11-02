# spirit/relay.js

The relay. This test holds one part of it (goal/G41.29): the two mails it sends, the join mail and the face's login
mail, so neither can be used to lead a user to a look-alike site. A relay is made on a scratch folder, its mailer a
stand-in; nothing is sent.

## Requirements

- **The join mail goes only to a link on the asker's own computer** (the box: *"the relay must refuse to send a
  join-email, unless the link in it points to the asker's own computer, so senders cannot use the relay to send phishing
  emails."*). The relay reads the link as an address, the way a browser does, and mails it only when all of these hold:
  the scheme is exactly http; the host is exactly 127.0.0.1; any port, or none; no user name or password (nothing
  before an @); the path starts with `/`. Anything else is refused, and no mail is sent.
  - The link a node sends, `http://127.0.0.1:<port>/face.html?app=join`, is mailed; so is one with no port.
  - A text test is not enough (the box: *"http://127.0.0.1.evil.com/ and http://127.0.0.1:1@evil.com/ both pass it and
    open the phisher's site."*): both are refused, as are https, localhost, 127.0.0.2, another site, a 127.0.0.1 only in the query and a user name
    on 127.0.0.1.
- **The login mail carries no link** (the box: *"The login-email must not carry a link, so a fake login-email cannot
  lead the user to a look-alike site"*). Asked with the member's own email, the relay mails a login that:
  - carries the token only, on a line of its own, easy to copy;
  - says where to paste it: *"Open your face by typing its address or from your bookmark, never from a link in a mail,
    and paste this token into its Log in field."*;
  - holds no link, and does not write out the face's address either, since most mail programs turn an address into a
    link by themselves.
  The token, pasted into the Log in field (`faceLogin(name, token)`), logs in.

- **A long search does not stop the relay** (goal/G41.30; the box: *"the server MUST not CRASH or HANG"*, *"Imitate
  that attacker!"*; Andy, of *"A long search query stalls the relay's event loop for seconds"*: *"fix this now. in this
  item"*). With 500 members seated and connected, one of them sends the longest search the wire carries, sealed to the
  relay (about 16,600 characters; a longer one, as the report's 60,000, is refused 413 by the wire). While it is
  answered, a tick every 5 ms must never wait more than 250 ms, and the search is still answered.

## What its test must try to break

- One search holding the relay's event loop, every other request waiting behind it.
- A join link mailed whose host only begins with 127.0.0.1, or carries a user name before an @, or is https, localhost
  or another site.
- The node's own link, with its port, refused.
- A login mail holding a link or the face's address, or without the words saying where to paste the token.
- A token that no longer logs in when pasted.
