# Mobile picker safety

Mobile browsers delegate file-source choices to the phone's system picker. ProofStamp cannot control whether Camera, Video, Recorder, Photos & videos, Files, My Files, Documents, or Browse appears first.

The app therefore does two things:

1. It explains how to reach both gallery media and documents from the system picker.
2. When media is selected on a mobile-sized device, it offers **Save original copy** in case the user created that media through Camera, Video, or Recorder and the phone did not persist it to the normal Photos/Files library.

The save action uses the exact selected `File` object and a browser-local download. Nothing is uploaded. The saved copy is convenience/preservation only and is not timestamp evidence.
