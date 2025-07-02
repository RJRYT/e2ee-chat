# E2EE Chat — End‑to‑End Encrypted MERN Chat App

Secure real-time messaging with client-side RSA-OAEP encryption.

---

## Table of Contents

1. [Features](#features)
2. [Demo](#demo)
3. [Tech Stack & Architecture](#tech-stack--architecture)
4. [Getting Started](#getting-started)

   * [Prerequisites](#prerequisites)
   * [Installation](#installation)
   * [Running the App](#running-the-app)
5. [Usage](#usage)
6. [Contributing](#contributing)
7. [License](#license)

---

## Features

* 🔒 **End‑to‑End Encryption**: Client‑side RSA‑OAEP for all messages and media.
* ⚡ **Real‑Time Chat**: Built on Socket.IO for instant messaging.
* 📁 **Encrypted Multimedia**: Secure image & video sharing.
* 🗝️ **Per‑User Keys**: Generates key pairs in-browser; private keys never leave client.
* 🔄 **Offline Resilience**: Messages queued & synced when back online.

---

## Demo

* Live Preview: [https://e2ee-chat-six.vercel.app](https://e2ee-chat-six.vercel.app)
* Source Code: [https://github.com/RJRYT/e2ee-chat](https://github.com/RJRYT/e2ee-chat)

---

## Tech Stack & Architecture

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Frontend   | React, React Router, Tailwind CSS |
| Backend    | Node.js, Express                  |
| Real‑Time  | Socket.IO                         |
| Database   | MongoDB                           |
| Encryption | Web Crypto API (RSA‑OAEP)         |

Message flow:

1. User generates RSA key pair in browser.
2. Public key stored in MongoDB; private key remains client‑side.
3. On send: message encrypted with recipient’s public key, sent via Socket.IO.
4. Recipient decrypts with private key, displays plaintext.

---

## Getting Started

### Prerequisites

* Node.js >= 16
* npm or yarn
* MongoDB instance (local or Atlas)

### Installation

```bash
# Clone the repo
git clone https://github.com/RJRYT/e2ee-chat.git
cd e2ee-chat

# Install dependencies
npm install
# or
yarn install
```

### Running the App

```bash
# Start backend (port 5000)
cd server
npm run dev

# Start frontend (port 3000)
cd ../client
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use.

---

## Usage

1. **Register**: Sign up with username & password.
2. **Key Generation**: Client auto‑generates RSA key pair.
3. **Add Contacts**: Enter another user’s username to chat.
4. **Chat**: Send text, images or videos securely.
5. **Offline**: Messages sent while offline sync when reconnected.
   
---

## Contributing

Contributions welcome! Please fork the repo, create a feature branch, and submit a pull request.

1. Fork it
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add YourFeature'`)
4. Push to branch (`git push origin feature/YourFeature`)
5. Open a pull request

---

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
