# Mobile picker safety

Mobile browsers delegate file-source choices to the phone's system picker. ProofStamp cannot control whether Camera, Video, Recorder, Photos & videos, Files, My Files, Documents, or Browse appears first.

The app therefore does two things:

1. It explains how to reach both gallery media and documents from the system picker.
2. It records when the picker opens. If an image, video, or audio file comes back with a `lastModified` timestamp from that picker session, ProofStamp treats it as a likely fresh Camera/Video/Recorder capture and offers **Save original copy**.

Existing gallery media with older timestamps and non-media documents do not get the preservation warning. Browser APIs do not expose the selected source directly, so this is deliberately a heuristic rather than a provenance claim.

When a likely fresh capture is detected, the preservation action receives focus after hashing instead of the Description field. After the user starts the local save, focus moves to Description so the normal ProofStamp flow can continue.

The save action uses the exact selected `File` object and a browser-local download. Nothing is uploaded. The saved copy is convenience/preservation only and is not timestamp evidence.
