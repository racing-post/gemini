'use strict';

//real methods will be populated at run time by ./test-api module
exports.suite = function() {};

//keys constants
exports.NULL = '\uE000';
exports.CANCEL = '\uE001';
exports.HELP = '\uE002';
exports.BACK_SPACE = '\uE003';
exports.TAB = '\uE004';
exports.CLEAR = '\uE005';
exports.RETURN = '\uE006';
exports.ENTER = '\uE007';
exports.SHIFT = exports.LEFT_SHIFT = '\uE008';
exports.CONTROL = exports.LEFT_CONTROL = '\uE009';
exports.ALT = exports.LEFT_ALT = '\uE00A';
exports.PAUSE = '\uE00B';
exports.ESCAPE = '\uE00C';
exports.SPACE = '\uE00D';
exports.PAGE_UP = '\uE00E';
exports.PAGE_DOWN = '\uE00F';
exports.END = '\uE010';
exports.HOME = '\uE011';
exports.LEFT = exports.ARROW_LEFT = '\uE012';
exports.UP = exports.ARROW_UP = '\uE013';
exports.RIGHT = exports.ARROW_RIGHT = '\uE014';
exports.DOWN = exports.ARROW_DOWN = '\uE015';
exports.INSERT = '\uE016';
exports.DELETE = '\uE017';
exports.SEMICOLON = '\uE018';
exports.EQUALS = '\uE019';
exports.NUMPAD0 = '\uE01A';
exports.NUMPAD1 = '\uE01B';
exports.NUMPAD2 = '\uE01C';
exports.NUMPAD3 = '\uE01D';
exports.NUMPAD4 = '\uE01E';
exports.NUMPAD5 = '\uE01F';
exports.NUMPAD6 = '\uE020';
exports.NUMPAD7 = '\uE021';
exports.NUMPAD8 = '\uE022';
exports.NUMPAD9 = '\uE023';
exports.MULTIPLY = '\uE024';
exports.ADD = '\uE025';
exports.SEPARATOR = '\uE026';
exports.SUBTRACT = '\uE027';
exports.DECIMAL = '\uE028';
exports.DIVIDE = '\uE029';
exports.F1 = '\uE031';
exports.F2 = '\uE032';
exports.F3 = '\uE033';
exports.F4 = '\uE034';
exports.F5 = '\uE035';
exports.F6 = '\uE036';
exports.F7 = '\uE037';
exports.F8 = '\uE038';
exports.F9 = '\uE039';
exports.F10 = '\uE03A';
exports.F11 = '\uE03B';
exports.F12 = '\uE03C';
exports.COMMAND = exports.META = '\uE03D';
exports.ZENKAKU_HANKAKU = '\uE040';
