const Desklet = imports.ui.desklet;
const St = imports.gi.St;

function main(metadata, desklet_id) {
    return new OpenWeatherDesklet(metadata, desklet_id);
}

class OpenWeatherDesklet extends Desklet.Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);
        this.setupUI();
    }

    setupUI() {
        // Main Container
        this.window = new St.BoxLayout({
            vertical: true, 
            style: "width: 180px; padding: 10px; background-color: rgba(0,0,0,0.6); border-radius: 12px; text-align: center;" 
        });

        // City Label
        this.lblCity = new St.Label({
            text: "OpenWeather",
            style: "font-size: 1.1em; font-weight: bold; color: #fff; margin-bottom: 5px;"
        });
        this.window.add(this.lblCity);

        // Temp Label
        this.lblTemp = new St.Label({
            text: "--°",
            style: "font-size: 2.5em; color: #fff; margin-bottom: 5px;"
        });
        this.window.add(this.lblTemp);

        // Status Label
        this.lblStatus = new St.Label({
            text: "Ready to code",
            style: "font-size: 0.8em; color: #ccc;"
        });
        this.window.add(this.lblStatus);

        this.setContent(this.window);
    }
}