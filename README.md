# Open Weather Desklet

A highly configurable, desktop-integrated weather widget for the **Cinnamon Desktop Environment** (Linux Mint).

This project was developed to provide a modern, functional alternative to unmaintained weather desklets. It was built to ensure reliable API support and seamless integration with current desktop standards, replacing older tools that had ceased to function.

## 🚀 Why This Project?

I built this because the existing options—specifically the legacy desklet by `tipichris`—had not been updated in over 8 years, resulting in broken API connections and a non-functional widget.

Rather than attempting to patch deprecated code, I treated this as a clean-slate engineering challenge. I wanted to build a reliable solution that works today, while using the opportunity to master the Cinnamon environment, system-level JavaScript, and asynchronous state management.

## ✨ Current Features

* **Dual-Provider Support:** Currently functional with OpenWeatherMap and Meteo.
* **Desktop Integration:** Renders weather conditions directly on the Cinnamon desktop background.
* **Foundation for Expansion:** Built with a modular architecture to easily accept new weather sources in future updates.

## 🔮 Roadmap / To-Do

This project is in active development. My immediate goals for the next release include:

* [ ] **UI Customization:** Adding support for custom SVG icon sets and user-defined transparency/CSS styling.
* [ ] **Expanded Providers:** Integrating 8+ additional sources (BBC, WeatherUnderground, etc.).
* [ ] **Smart Features:** Implementing IP-based auto-location and local data caching to minimize API usage.
* [ ] **Refactoring:** Modernizing the network requests to use Promises/Async-Await instead of callbacks.

## 🛠️ Technical Stack

For those interested in how this works under the hood:

* **Language:** JavaScript (Cinnamon JS / SpiderMonkey Engine).
* **UI Toolkit:** `St` (Shell Toolkit) & `Clutter` (OpenGL Scenegraph).
* **Networking:** `LibSoup` (Asynchronous HTTP/REST implementation via GObject Introspection).
* **Architecture:** Event-driven architecture running on the GLib Main Loop.

## 📦 Installation

### The Developer Way (Manual Install)

To test the latest code from this repository:

```bash
# 1. Navigate to the local desklet folder
cd ~/.local/share/cinnamon/desklets/

# 2. Clone this repo
# IMPORTANT: The directory name must match the UUID 'openweather@firelokdesigns'
git clone https://github.com/carycourson/Open_Weather_Desklet.git openweather@firelokdesigns

# 3. Enable the Desklet
# Open "Desklets" settings in Linux Mint, find "Open Weather," and add it to your desktop.

```

## ⚙️ Configuration

The desklet is configured via a generated JSON schema GUI (`settings-schema.json`).

* **API Keys:** Most providers (like OpenWeatherMap) require a free or nearly free API key. Open-Meteo is available as a key-free alternative for testing.
* **Styling:** Users can drop custom icon sets into the `/icons` folder or edit `stylesheet.css` for font tweaks.

## 🔮 Roadmap / To-Do

This is an active personal project. Current goals include:

* [ ] Refactoring the legacy callback-based network code to modern Promises/Async-Await.
* [ ] Adding TypeScript JSDoc annotations for better type safety.
* [ ] Implementing a CI/CD action to auto-package releases.

## 🤝 Credits & Attribution

This project stands on the shoulders of open-source giants.

* **Inspiring Author:** Chris Hastie (`tipichris`)

**License:** GNU General Public License v3.0 (GPLv3)

---
