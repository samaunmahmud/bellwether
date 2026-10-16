import { gql } from '@apollo/client';

const BRIEFING_FIELDS = gql`
  fragment BriefingFields on Briefing {
    date
    generatedAt
    isStale
    flaggedCount
    farm {
      id
      name
    }
    overdueTasks {
      id
      title
      dueDate
      group {
        id
        name
      }
    }
    groups {
      groupId
      groupName
      fieldName
      items {
        riskId
        riskName
        level
        daysAffected {
          date
          level
        }
        reason
        checks
        isNew
      }
    }
    quietGroups {
      groupId
      groupName
    }
  }
`;

export const BRIEFING_QUERY = gql`
  ${BRIEFING_FIELDS}
  query Briefing($farmId: ID!) {
    briefing(farmId: $farmId) {
      ...BriefingFields
    }
  }
`;

export const REFRESH_BRIEFING = gql`
  ${BRIEFING_FIELDS}
  mutation RefreshBriefing($farmId: ID!) {
    refreshBriefing(farmId: $farmId) {
      ...BriefingFields
    }
  }
`;

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
    }
  }
`;

export const SET_TASK_DONE = gql`
  mutation SetTaskDone($id: ID!, $done: Boolean!) {
    setTaskDone(id: $id, done: $done) {
      id
      done
    }
  }
`;

export const BRIEFING_PREFERENCES = gql`
  query BriefingPreferences($farmId: ID!) {
    briefingPreferences(farmId: $farmId) {
      emailEnabled
      sendAt
      alwaysSend
    }
  }
`;

export const SET_BRIEFING_PREFERENCES = gql`
  mutation SetBriefingPreferences($farmId: ID!, $input: BriefingPreferencesInput!) {
    setBriefingPreferences(farmId: $farmId, input: $input) {
      emailEnabled
      sendAt
      alwaysSend
    }
  }
`;

// FR-5.3: the farm's task list

export const TASKS_PAGE_QUERY = gql`
  query TasksPage($farmId: ID!) {
    farm(id: $farmId) {
      id
      name
      groups {
        id
        name
      }
    }
    tasks(farmId: $farmId) {
      id
      title
      dueDate
      note
      done
      overdue
      repeatEveryDays
      group {
        id
        name
      }
    }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;
