# deskVerify: the verifier's dataset

What this node's deskVerify keeps: the latest state of every test it has measured, with the why of each red, and every run it was handed (goal/G21.3, goal/G33.3). Agents may read it through `search`; nothing is written through it, and deskVerify presses nothing on anybody's behalf. It knows nothing of the desk: an agent hands its own node's verifier a run (`run {suites, commit}`, answered taken or busy) to see its work green there before it claims, and reads the outcome through `search` over runs.
