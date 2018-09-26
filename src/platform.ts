'use strict';

export class Platform {

    static identify(map) {
        if (map[Platform.OS]) {
            return map[Platform.OS]();
        }
        return map['default'] ? map['default']() : undefined;
    }

    static getHome() {
        return '';
    }

    static getOS(): string {
        return process.platform;
    }

    static get OS(): string {
        return Platform.getOS();
    }

    static get ENV() {
        return Platform.getEnv();
    }

    static getEnv() {
        return process.env;
    }

    static getUserHomePath() {
        return Platform.identify({
            win32: () => Platform.ENV.USERPROFILE,
            default: () => Platform.ENV.HOME
        });
    }
}
