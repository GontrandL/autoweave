/**
 * @name Hardcoded API keys in AutoWeave
 * @description Detects hardcoded API keys or secrets in the codebase
 * @kind problem
 * @problem.severity error
 * @id autoweave/hardcoded-secrets
 * @tags security
 *       external/cwe/cwe-798
 */

import javascript

from StringLiteral s
where 
  s.getValue().regexpMatch("(?i)(api[_-]?key|apikey|secret|password|token)\\s*[:=]\\s*['\"][^'\"]+['\"]") or
  s.getValue().regexpMatch("sk-[a-zA-Z0-9]{48}") or // OpenAI key pattern
  s.getValue().regexpMatch("ghp_[a-zA-Z0-9]{36}") or // GitHub token pattern
  s.getValue().regexpMatch("npm_[a-zA-Z0-9]{36}") // NPM token pattern
select s, "Hardcoded secret or API key found: " + s.getValue()