export class HidePassword {

    static hideTokenpassword(value: string) {
        const regex = /--token\s*=\s*([^\s]*)/;
        const tokenRegex = value.match(regex);
        return (tokenRegex) ?  value.replace(tokenRegex[1], '**********') : value;
    }

    static hideCredentialPassword(value: string) {
        const regex = /-p\s*(.*)\s/;
        const tokenRegex = value.match(regex);
        return (tokenRegex) ? value.replace(tokenRegex[0], '-p **********'): value;
    }
}