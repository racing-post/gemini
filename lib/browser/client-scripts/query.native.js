'use strict';

exports.first = function(selector) {
    return document.querySelector(selector);
};

exports.xpath = function(selector) {
    return document.evaluate(selector, document.body, null, XPathResult.ANY_TYPE, null ).iterateNext();
};

exports.all = function(selector) {
    return document.querySelectorAll(selector);
};
