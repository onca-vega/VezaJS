class ModelBuilder {
  constructor(config, name) {
    this._modelerName = config.name;
    this._url = config.url;
    this._params = config.params instanceof Object && Object.keys(config.params).length ? config.params : null;
    this._headers = config.headers instanceof Object && Object.keys(config.headers).length ? config.headers : null;
    this._requestType = !!config.requestType && typeof config.requestType === "string" ? config.requestType : null;
    this._responseType = !!config.responseType && typeof config.responseType === "string" ? config.responseType : null;
    this._body = config.body instanceof Object && Object.keys(config.body).length ? config.body : null;

    this._name = name;
  }
  get(data = {}) {
    return this._setRequest(data, "GET");
  }
  head(data = {}) {
    return this._setRequest(data, "HEAD");
  }
  post(data = {}) {
    return this._setRequest(data, "POST", true);
  }
  patch(data = {}) {
    return this._setRequest(data, "PATCH", true);
  }
  put(data = {}) {
    return this._setRequest(data, "PUT", true);
  }
  remove(data = {}) {
    return this._setRequest(data, "DELETE", true);
  }
  _setRequest(data, method, setBody = false) {
    if (!(data instanceof Object)) {
      console.error(`Neysla: The model's configuration must be an object.`);
      return false;
    } else if (data.delimiters && !(data.delimiters instanceof Array || typeof data.delimiters === "string" || typeof data.delimiters === "number")) {
      console.error(`Neysla: The model's delimiters are not properly defined.`);
      return false;
    }

    let url = this._setUrl(data.delimiters); // Set relative URL with delimiters
    if (url === false) {
      return url;
    }

    url += this._setParams(data.params); // Handle params

    const headers = this._setHeaders(data.headers); // Handle headers
    const body = setBody ? this._setBody(data.body, data.requestType || this._requestType) : null; // Handle body
    const requestType = this._setRequestType(data.requestType); // Handle request type
    const responseType = typeof data.responseType === "string"
      ? data.responseType : typeof this._responseType === "string"
      ? this._responseType : "json"; // Handle response type

    if (!(data.progress instanceof Function)) {
      data.progress = function(){};
    }

    return this._executeRequest({
      method,
      url,
      headers,
      body,
      requestType,
      responseType,
      progress: data.progress
    });
  }
  _setUrl(delimiters) {
    if (delimiters && !(delimiters instanceof Array)) {
      delimiters = [ delimiters ];
    } else if (!delimiters) {
      delimiters = [];
    }

    if (typeof this._name === "string") {
      this._name = [ this._name ];
    }

    if (!(this._name.length === delimiters.length || this._name.length - 1 === delimiters.length)) {
      console.error(`Neysla: Incorrect relation between name and delimiters.`);
      return false;
    }

    let relativeUrl = "";
    for (let i in this._name) {
      relativeUrl += `${ this._name[i] }${ delimiters[i] ? ('/' + delimiters[i]) : '' }${ parseInt(i, 10) === this._name.length - 1 ? '' : '/' }`;
    }

    return this._url + relativeUrl;
  }
  _setParams(params) {
    let paramsRequest = "";
    let paramsComplete = null;

    if (this._params instanceof Object) {
      paramsComplete = { ...this._params };
    }

    if (params instanceof Object) { // Handle predefined params
      paramsComplete = { ...paramsComplete, ...params };
    }

    if (paramsComplete instanceof Object) { // Handle params
      Object.keys(paramsComplete).forEach((key, i) => {
        paramsRequest += `${ i !== 0 ? '&' : '?' }${ key }=${ paramsComplete[key] }`;
      });
    }

    return paramsRequest;
  }
  _setHeaders(headers) {
    let headersComplete = {};

    if (this._headers instanceof Object) { // Handle predefined headers
      headersComplete = { ...this._headers };
    }

    if (headers instanceof Object) { // Handle headers
      headersComplete = { ...headersComplete, ...headers };
    }

    return headersComplete;
  }
  _setRequestType(requestType = this._requestType) {
    let finalType;

    switch (requestType) {
      case "json":
        finalType = "application/json";
        break;
      case "multipart":
        finalType = null;
        break;
      default:
        finalType = "application/x-www-form-urlencoded";
    }
    return finalType;
  }
  _setBody(body, requestType) {
    let bodyRequest = null;
    let bodyComplete = null;

    if (this._body instanceof Object) { // Handle predefined body
      bodyComplete = { ...this._body };
    }

    if (body instanceof Object) { // Handle body
      bodyComplete = { ...bodyComplete, ...body };
    }

    if (bodyComplete instanceof Object) {
      switch (requestType) {
        case "json":                                    //Definition of body for JSON
          bodyRequest = JSON.stringify(bodyComplete);
          break;
        case "multipart":                               //Definition of body for multipart
          bodyRequest = new FormData();
          Object.keys(bodyComplete).forEach(key => bodyRequest.append(key, bodyComplete[key]));
          break;
        default:                                        //Definition of body for x-www-form-urlencoded
          bodyRequest = "";
          Object.keys(bodyComplete).forEach(key => bodyRequest += `${ bodyRequest !== "" ? "&": "" }${ key }=${ bodyComplete[key] }`);
      }
    }

    return bodyRequest;
  }
  _executeRequest(needs) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.addEventListener("progress", needs.progress);
      request.addEventListener("abort", () => this._handleResponse(request, resolve, reject, needs.url, needs.responseType, true));
      request.addEventListener("error", () => this._handleResponse(request, resolve, reject, needs.url, needs.responseType, true));
      request.addEventListener("load", () => this._handleResponse(request, resolve, reject, needs.url, needs.responseType));     //Handle response
      request.open(needs.method, needs.url, true); // true for asynchronous
      request.responseType = needs.responseType;

      if (needs.requestType) {
        request.setRequestHeader("Content-Type", needs.requestType);    //Set header content type
      }

      for (let header in needs.headers) {
        if (needs.headers.hasOwnProperty(header)) {
          request.setRequestHeader(header, needs.headers[header]);    //Set custom headers
        }
      }

      request.send(needs.body);                       //Send request
    });
  }
  _handleResponse(request, resolve, reject, url, responseType, requestError = false) {
    const response = {
      headers: {},
      status: request.status,
      statusText: request.statusText,
      getHeader: (t) => request.getResponseHeader(t),
      data: (!requestError && responseType === "json" && typeof request.response === "string") ? JSON.parse(request.response) : request.response, // handle IE lack of json responseType
      dataType: request.responseType,
      url
    };

    let headersArray = request.getAllResponseHeaders().split("\r\n");

    for (const o of headersArray) {
      if (o !== "") {
        const header = o.split(":");
        response.headers[header[0]] = header[1].trim();
      }
    }

    (request.status >= 300 || request.status === 0 || requestError) ? reject(response) : resolve(response);
  }
}

module.exports = ModelBuilder;
