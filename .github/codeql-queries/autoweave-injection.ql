/**
 * @name Command injection in AutoWeave agents
 * @description Detects potential command injection vulnerabilities in agent code
 * @kind path-problem
 * @problem.severity error
 * @id autoweave/command-injection
 * @tags security
 *       external/cwe/cwe-078
 */

import javascript
import semmle.javascript.security.dataflow.CommandInjection

from DataFlow::Node source, DataFlow::Node sink
where
  exists(CommandInjection::Configuration cfg |
    cfg.hasFlow(source, sink) and
    sink.getFile().getRelativePath().matches("packages/agents/%") 
  )
select sink, source, sink, "Potential command injection from $@ to agent execution", source, "user input"