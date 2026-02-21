type Callback = (...args: any[]) => void;

class EventEmitter {
    private events: Record<string, Callback[]> = {};

    on(event: string, callback: Callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }

    emit(event: string, ...args: any[]) {
        if (!this.events[event]) return;
        this.events[event].forEach(cb => cb(...args));
    }
}

export const events = new EventEmitter();

// --- Event Constants ---
export const UI_EVENTS = {
    MODE_SWITCH: 'ui:mode_switch',
    TOGGLE_2D: 'ui:toggle_2d',
    TOGGLE_BLOOM: 'ui:toggle_bloom',
    RESET_CAMERA: 'ui:reset_camera',
    HARMONIC_CHANGE: 'ui:harmonic_change'
};

export const AUDIO_EVENTS = {
    BEAT: 'audio:beat', // Triggered on high energy
    STATION_CHANGE: 'audio:station_change'
};
