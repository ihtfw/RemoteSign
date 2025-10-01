# RemoteSign

A small, production-ready ASP.NET Core 9 service that signs Windows PE files (EXE/DLL) with **Authenticode** using a **RuToken** (PKCS#11) on Linux. It calls `osslsigncode` with a PKCS#11 URI and RFC-3161 timestamp.

## Features

- Simple REST API
- Hardware token access serialized with a gate
- Non-interactive PIN via `pin-source=file:` (no prompts)
- Clear logs and health endpoint
- Minimal dependencies, standard layout, unit tests

## Requirements (Ubuntu 22.04)

```bash
sudo apt update
sudo apt install -y pcscd pcsc-tools libccid opensc \
                    libengine-pkcs11-openssl osslsigncode

sudo systemctl enable --now pcscd
```
