(function() {
  var template = Handlebars.template, templates = Handlebars.templates = Handlebars.templates || {};
templates['Header.hbs'] = template({"1":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "            <span class=\"username\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"userName") || (depth0 != null ? lookupProperty(depth0,"userName") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"userName","hash":{},"data":data,"loc":{"start":{"line":11,"column":35},"end":{"line":11,"column":47}}}) : helper)))
    + "</span>\n            <img src=\"img/user-avatar.png\" alt=\"User avatar\" class=\"avatar\">\n";
},"3":function(container,depth0,helpers,partials,data) {
    return "            <button class=\"btn\" data-action=\"sign-in\" type=\"button\">Войти</button>\n            <button class=\"btn\" data-action=\"sign-up\" type=\"button\">Зарегистрироваться</button>\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<div class=\"header-container\"> \n    <div class=\"name\">\n        <h1 class=\"name-text\">Vkino</h1>\n    </div>           \n    <div class=\"search-bar\">\n        <input type=\"text\" placeholder=\"Поиск\" class=\"search-input\">\n    </div>\n    \n    <div class=\"user-profile\">\n"
    + ((stack1 = lookupProperty(helpers,"if").call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? lookupProperty(depth0,"isAuthorized") : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.program(3, data, 0),"data":data,"loc":{"start":{"line":10,"column":8},"end":{"line":16,"column":15}}})) != null ? stack1 : "")
    + "    </div>\n</div>";
},"useData":true});
})();